#!/bin/sh
set -e

DATABASE_URL=$(node dist/src/database-url.js)
export DATABASE_URL
# The selected application root validates its configuration before providers start.
exec "$@"
