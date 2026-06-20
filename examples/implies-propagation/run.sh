#!/usr/bin/env bash
# ============================================================================
# implies type-propagation — demo + durable regression guard
#
# Proves, against the REAL local @digital-alchemy/core, that a downstream app
# importing ONLY a library gets its `implies`-bundled members both WIRED
# (runtime membership) and TYPED (cross-package declaration-merge), with zero
# extra registration — provided services are literal named function declarations.
#
#   @digital-alchemy/core  -> the local repo under test (built to dist)
#   @demo/home-libraries   -> lighting (named-fn) + living-room (implies lighting)
#   @demo/home-app         -> imports ONLY living-room; uses params.lighting
#
# All output streams inline.
# ============================================================================
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
CORE="$(cd "$ROOT/../.." && pwd)"
TSC="$CORE/node_modules/.bin/tsc"
TSX="$CORE/node_modules/.bin/tsx"
link() { mkdir -p "$(dirname "$2")"; rm -rf "$2"; ln -s "$1" "$2"; }

echo "### [1] build @digital-alchemy/core (the lib under test)"
( cd "$CORE" && yarn build ) || { echo "FAIL: core build"; exit 1; }

echo "### [2] wire node_modules symlinks (simulate a published install)"
link "$CORE" "$ROOT/home-libraries/node_modules/@digital-alchemy/core"
link "$CORE" "$ROOT/home-app/node_modules/@digital-alchemy/core"
link "$ROOT/home-libraries" "$ROOT/home-app/node_modules/@demo/home-libraries"

echo "### [3] build @demo/home-libraries (emits the .d.mts the app consumes)"
rm -rf "$ROOT/home-libraries/dist"
"$TSC" -p "$ROOT/home-libraries/tsconfig.json" || { echo "FAIL: home-libraries build"; exit 1; }

echo "### [4] PROOF — typecheck the app (imports only living-room; lighting via implies)"
if "$TSC" -p "$ROOT/home-app/tsconfig.json"; then
  echo "    ✓ types propagate: params.lighting is present and genuinely typed"
else
  echo "    ✗ REGRESSION: implied member types did not propagate through implies"
  exit 1
fi

echo "### [5] DEMO — run the app (lighting is wired via implies, never listed)"
echo "------------------------------------------------------------------"
"$TSX" "$ROOT/home-app/src/main.mts" || { echo "FAIL: demo run"; exit 1; }
echo "------------------------------------------------------------------"
echo "### done — implied library was typed (step 4) and wired (step 5) with no registration"
