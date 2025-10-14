#!/bin/bash

# Frontend test script that explicitly uses Vitest
# This ensures consistent test execution in both local and CI environments

cd "$(dirname "$0")"

echo "🧪 Running frontend tests with Vitest..."

# Use bunx to run vitest with explicit config
bunx vitest --config vitest.config.ts "$@"
