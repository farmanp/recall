#!/bin/bash

# Navigate to backend directory
cd "$(dirname "$0")"

# Run tests with coverage
echo "Running tests with coverage..."
npm test -- --run --coverage

# Show coverage summary
echo ""
echo "Test run complete!"
