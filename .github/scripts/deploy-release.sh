#!/bin/sh
set -eu

compose() {
    docker compose --env-file .env.production "$@"
}

check_legacy_backend() {
    if [ -f docker-compose.yml ] && [ -f .env.production ]; then
        services=$(compose ps --all --orphans --format '{{.Service}}')
        if printf '%s\n' "$services" | grep -qx backend; then
            printf '%s\n' 'Legacy backend container detected. Complete the documented split-process cutover and remove only the verified legacy container before automatic deployment.' >&2
            exit 1
        fi
    fi
}

check_legacy_backend
if [ "${1:-}" = --check-legacy ]; then
    exit 0
fi

chmod 600 .env.production
chmod +x gateway-render.sh
compose config --quiet
compose pull
# Validate origins, routing syntax and mounted certificates before starting roles.
compose run --rm --no-deps nginx nginx -t
# Compose waits for the single migration job before starting any runtime role.
compose up -d --wait --wait-timeout 180 public-api admin-api worker frontend
compose up -d --no-deps --force-recreate --wait --wait-timeout 60 nginx
printf '%s\n' 'Split-process deployment completed'
