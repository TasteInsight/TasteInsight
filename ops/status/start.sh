#!/bin/sh
set -eu
case "$STATUS_PUBLIC_ENABLED" in
    true|false) ;;
    *) echo "STATUS_PUBLIC_ENABLED must be true or false" >&2; exit 1 ;;
esac
case "$STATUS_PAGE_SLUG" in
    ""|*[!a-z0-9-]*) echo "STATUS_PAGE_SLUG must contain lowercase letters, digits or hyphens" >&2; exit 1 ;;
esac
if [ "${#STATUS_PAGE_SLUG}" -gt 64 ]; then
    echo "STATUS_PAGE_SLUG must be at most 64 characters" >&2
    exit 1
fi
envsubst '${STATUS_PUBLIC_ENABLED} ${STATUS_PAGE_SLUG}' < /etc/nginx/status.conf.template > /tmp/nginx.conf
exec nginx -c /tmp/nginx.conf -g 'daemon off;'
