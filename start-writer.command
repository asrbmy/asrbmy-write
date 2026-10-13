#!/usr/bin/env bash
# Run ./start-writer.sh (macOS / Linux). Needs Node.js from nodejs.org.
cd "$(dirname "$0")"
[ -d node_modules ] || { echo "Installing, one moment..."; npm install; }
node writer/server.js
