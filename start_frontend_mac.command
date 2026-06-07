#!/bin/bash
cd "$(dirname "$0")/frontend"
echo "Using public npm registry..."
npm config set registry https://registry.npmjs.org/
echo "Installing frontend dependencies. If this ever hangs, press Ctrl+C and run: npm cache clean --force"
npm install --no-audit --no-fund --legacy-peer-deps
npm run dev
