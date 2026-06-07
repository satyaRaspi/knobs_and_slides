#!/bin/bash
cd "$(dirname "$0")/frontend"
echo "Cleaning stuck npm frontend install..."
rm -rf node_modules package-lock.json
npm cache clean --force
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund --legacy-peer-deps --verbose
npm run dev
