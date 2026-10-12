#!/bin/sh
set -eu

fail() {
    printf '%s\n' "Gateway configuration: $1" >&2
    exit 1
}

origin_host() {
    value=$1
    name=$2
    case "$value" in
        http://*|https://*) ;;
        *) fail "$name must be an HTTP(S) origin with a DNS hostname" ;;
    esac
    authority=${value#*://}
    authority=${authority%/}
    case "$authority" in
        *[!a-zA-Z0-9.:-]*|'') fail "$name must not contain credentials, a path, query or fragment" ;;
    esac
    host=${authority%%:*}
    if [ "$authority" != "$host" ]; then
        port=${authority#*:}
        case "$port" in
            ''|*[!0-9]*) fail "$name has an invalid port" ;;
        esac
        [ "${#port}" -le 5 ] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || fail "$name has an invalid port"
    fi
    [ "${#host}" -le 253 ] || fail "$name has an invalid DNS hostname"
    printf '%s\n' "$host" | awk -F. '
        { for (i = 1; i <= NF; i++)
            if (length($i) > 63 || $i !~ /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/) exit 1
        }' || fail "$name has an invalid DNS hostname"
    printf '%s' "$host" | tr '[:upper:]' '[:lower:]'
}

PUBLIC_HOST=$(origin_host "${APP_URL:-}" APP_URL)
ADMIN_HOST=$(origin_host "${ADMIN_APP_URL:-}" ADMIN_APP_URL)
[ "$PUBLIC_HOST" != "$ADMIN_HOST" ] || fail 'APP_URL and ADMIN_APP_URL must use different hostnames'
case "$PUBLIC_HOST:$ADMIN_HOST" in
    localhost:*|*:localhost|127.0.0.1:*|*:127.0.0.1) fail 'localhost and 127.0.0.1 are reserved for readiness probes' ;;
esac
PUBLIC_ORIGIN=${APP_URL%/}
ADMIN_ORIGIN=${ADMIN_APP_URL%/}
PUBLIC_SCHEME=${APP_URL%%:*}
ADMIN_SCHEME=${ADMIN_APP_URL%%:*}
TLS_CERT_FILE=${TLS_CERT_FILE:-fullchain.pem}
TLS_KEY_FILE=${TLS_KEY_FILE:-private.key}
for certificate_file in "$TLS_CERT_FILE" "$TLS_KEY_FILE"; do
    case "$certificate_file" in
        ''|.|..|*[!a-zA-Z0-9_.-]*) fail 'TLS certificate and key must be filenames inside the mounted certificate directory' ;;
    esac
done

case "${GATEWAY_TLS_MODE:-off}" in
    off) template=nginx.conf ;;
    on)
        [ "$PUBLIC_SCHEME:$ADMIN_SCHEME" = https:https ] || fail 'GATEWAY_TLS_MODE=on requires HTTPS origins'
        template=nginx.https.conf.template
        ;;
    *) fail 'GATEWAY_TLS_MODE must be off or on' ;;
esac

export PUBLIC_HOST ADMIN_HOST PUBLIC_ORIGIN ADMIN_ORIGIN PUBLIC_SCHEME ADMIN_SCHEME TLS_CERT_FILE TLS_KEY_FILE
template_dir=${1:-/etc/tasteinsight/nginx}
output_dir=${2:-/etc/nginx}
mkdir -p "$output_dir/conf.d" "$output_dir/tasteinsight"
variables='${PUBLIC_HOST} ${ADMIN_HOST} ${PUBLIC_ORIGIN} ${ADMIN_ORIGIN} ${PUBLIC_SCHEME} ${ADMIN_SCHEME} ${TLS_CERT_FILE} ${TLS_KEY_FILE}'
for fragment in nginx.common.conf nginx.public.conf nginx.admin.conf; do
    envsubst "$variables" < "$template_dir/$fragment" > "$output_dir/tasteinsight/$fragment"
done
envsubst "$variables" < "$template_dir/$template" > "$output_dir/conf.d/default.conf"
