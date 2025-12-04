#!/bin/sh
set -e

echo "Running migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "Running seed_docker.ts..."
  ./node_modules/.bin/ts-node prisma/seed_docker.ts
else
  echo "Skipping seed..."
fi

if [ "$IMPORT_DATA" = "true" ]; then
  echo "Running import_canteens.ts..."
  ./node_modules/.bin/ts-node prisma/import_canteens.ts
fi

exec "$@"
