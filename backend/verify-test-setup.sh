#!/bin/bash

echo "🔍 Verifying Test Suite Setup..."
echo ""

# Navigate to backend directory
cd "$(dirname "$0")"

# Check for required files
echo "📁 Checking test files..."

files=(
  "vitest.config.ts"
  "src/__tests__/setup.ts"
  "src/__tests__/db/queries.test.ts"
  "src/__tests__/routes/sessions.test.ts"
  "src/__tests__/server.test.ts"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file (MISSING)"
    all_exist=false
  fi
done

echo ""
echo "📦 Checking dependencies..."

# Check if dependencies are installed
deps=(
  "vitest"
  "@vitest/ui"
  "@vitest/coverage-v8"
  "supertest"
  "@types/supertest"
)

for dep in "${deps[@]}"; do
  if npm list "$dep" > /dev/null 2>&1; then
    echo "  ✅ $dep"
  else
    echo "  ❌ $dep (NOT INSTALLED)"
    all_exist=false
  fi
done

echo ""
echo "🔧 Checking package.json scripts..."

# Check for test scripts
if grep -q '"test": "vitest"' package.json; then
  echo "  ✅ npm test"
else
  echo "  ❌ npm test (NOT CONFIGURED)"
  all_exist=false
fi

if grep -q '"test:ui": "vitest --ui"' package.json; then
  echo "  ✅ npm run test:ui"
else
  echo "  ❌ npm run test:ui (NOT CONFIGURED)"
  all_exist=false
fi

if grep -q '"test:coverage": "vitest --coverage"' package.json; then
  echo "  ✅ npm run test:coverage"
else
  echo "  ❌ npm run test:coverage (NOT CONFIGURED)"
  all_exist=false
fi

echo ""

if [ "$all_exist" = true ]; then
  echo "✅ All test suite components are properly set up!"
  echo ""
  echo "🚀 Ready to run tests:"
  echo "   npm test -- --run           # Run all tests"
  echo "   npm run test:coverage       # Run with coverage"
  echo "   npm run test:ui             # Run with interactive UI"
  exit 0
else
  echo "❌ Some components are missing. Please review the setup."
  exit 1
fi
