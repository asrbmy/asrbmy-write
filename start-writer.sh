#!/usr/bin/env bash
# Run ./start-writer.sh (macOS / Linux). Needs Node.js from nodejs.org.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Download it from https://nodejs.org (the LTS version), install it, then run this again."; exit 1; }
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" || { echo "Your Node.js is too old (version 20 or newer is needed). Get the current LTS from https://nodejs.org"; exit 1; }
[ -d node_modules ] || { echo "Installing, one moment..."; npm install; }
node writer/server.js
