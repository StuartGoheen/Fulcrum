#!/bin/bash
set -e

npm install --prefer-offline --no-audit --no-fund 2>/dev/null || npm install

npx tailwindcss -i css/input.css -o public/css/output.css --minify

# Regression check: verify the player-facing conversation payload (REST +
# socket broadcasts) contains no gmNote / gmNotes leaks. See
# scripts/test-conversation-no-gm-leak.js.
node scripts/test-conversation-no-gm-leak.js

# Regression check: verify the player-facing campaign-state payload
# (`state:sync` broadcasts) contains no GM-only adv3_tournament fields after
# `_filterStateForPlayers`. See scripts/test-state-no-gm-leak.js.
node scripts/test-state-no-gm-leak.js
