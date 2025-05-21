#!/bin/bash

VERSION=$(sentry-cli releases propose-version)

sentry-cli releases new "$VERSION"
sentry-cli releases set-commits --auto "$VERSION"
sentry-cli releases finalize "$VERSION"
sentry-cli releases deploys "$VERSION" new -e production

echo "Deploy step would go here. App version $VERSION"
