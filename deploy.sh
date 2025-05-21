#!/bin/bash
set -euo pipefail

START_TIME=$(date +%s)
VERSION=$(sentry-cli releases propose-version)

sentry-cli releases new "$VERSION"
sentry-cli releases set-commits --auto "$VERSION"
sentry-cli releases finalize "$VERSION"
sentry-cli releases deploys "$VERSION" new -e production

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "App version $VERSION deployed in $DURATION seconds"
