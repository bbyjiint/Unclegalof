#!/usr/bin/env sh
# Workaround: Buildx/Compose bake can fail with
# "x-docker-expose-session-sharedkey ... non-printable ASCII" when the repo path
# contains non-ASCII characters (e.g. Thai folder names). Classic builder avoids it.
set -e
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export COMPOSE_BAKE=false
export DOCKER_BUILDKIT=0
exec docker compose "$@"
