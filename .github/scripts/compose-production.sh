#!/bin/sh
set -eu

deploy_root=${DEPLOY_ROOT:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}
release=${DEPLOY_RELEASE:-$(readlink -f "$deploy_root/current")}

# Earlier releases use the same server configuration without an image overlay.
if [ -f "$release/compose.release.json" ]; then
    set -- -f "$release/compose.release.json" "$@"
fi

exec docker compose --project-name tasteinsight-production \
    --project-directory "$release/backend" \
    --env-file "$deploy_root/shared/.env.production" \
    -f "$release/backend/docker-compose.yml" \
    -f "$release/compose.production.yml" \
    -f "$release/compose.status.json" "$@"
