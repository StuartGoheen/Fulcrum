#!/bin/bash
set -e

npm install --prefer-offline --no-audit --no-fund 2>/dev/null || npm install

npx tailwindcss -i css/input.css -o public/css/output.css --minify
