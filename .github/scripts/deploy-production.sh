#!/bin/sh
set -eu
umask 027

deploy_root=$(readlink -f "${1:?Usage: deploy-production.sh ROOT RELEASE_ID IMAGE_REGISTRY IMAGE_TAG}")
release_id=${2:?Release ID is required}
registry=${3:?Image registry is required}
image_tag=${4:?Image tag is required}
case "$release_id" in
    ''|.|..|*[!a-zA-Z0-9._-]*) printf '%s\n' 'Invalid release ID' >&2; exit 1 ;;
esac
previous=$(readlink -f "$deploy_root/current")
release="$deploy_root/releases/$release_id"
test -d "$previous/backend"
test -r "$deploy_root/shared/.env.production"

legacy=$(docker ps --all \
    --filter label=com.docker.compose.project=tasteinsight-production \
    --filter label=com.docker.compose.service=backend --format '{{.ID}}')
if [ -n "$legacy" ]; then
    printf '%s\n' 'Legacy backend container detected. Complete the split-process cutover before production deployment.' >&2
    exit 1
fi

mkdir "$release"
tar -xzf "$deploy_root/staging/$release_id.tar.gz" -C "$release"
# Keep the host's resource limits, network, status route and operations entry.
cp "$previous/compose.production.yml" "$previous/compose.status.json" "$release/"
cp "$previous/status.nginx.conf" "$release/"
cp -R "$previous/ops" "$release/ops"
chmod +x "$release/backend/gateway-render.sh"

# Apply release images after server overrides, including previously pinned images.
python3 - "$release" "$registry" "$image_tag" <<'PY'
import json
import pathlib
import sys

release, registry, tag = sys.argv[1:]
images = {role: 'backend' for role in ['public-api', 'admin-api', 'worker', 'migrate']}
images.update({'frontend': 'frontend', 'embedding-service': 'embedding', 'werss': 'werss'})
configuration = {'services': {
    role: {'image': f'{registry}/tasteinsight-{image}:{tag}'}
    for role, image in images.items()
}}
pathlib.Path(release, 'compose.release.json').write_text(json.dumps(configuration, indent=2) + '\n')
PY

export DEPLOY_ROOT="$deploy_root" DEPLOY_RELEASE="$release"
compose() {
    sh "$release/.github/scripts/compose-production.sh" "$@"
}

compose config --quiet
compose pull
compose run --rm --no-deps nginx nginx -t
# The migration dependency must finish successfully before runtime roles start.
compose up -d --wait --wait-timeout 180 public-api admin-api worker frontend
compose up -d --no-deps --force-recreate --wait --wait-timeout 60 nginx

cp "$release/.github/scripts/compose-production.sh" "$deploy_root/bin/compose.sh.next"
chmod 750 "$deploy_root/bin/compose.sh.next"
python3 - "$deploy_root" "$release" <<'PY'
import os
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
os.replace(root / 'bin/compose.sh.next', root / 'bin/compose.sh')
pending = root / ('.current-' + pathlib.Path(sys.argv[2]).name)
os.symlink(sys.argv[2], pending)
os.replace(pending, root / 'current')
PY
printf 'Production deployment completed: %s\nPrevious release: %s\n' "$release" "$previous"
