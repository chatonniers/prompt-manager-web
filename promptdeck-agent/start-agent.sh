#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
nohup node "$DIR/agent.js" > "$DIR/agent.log" 2>&1 &
