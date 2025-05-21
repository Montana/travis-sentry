#!/bin/bash
[ -z "$1" ] && echo "Usage: $0 <host> [start_port] [end_port]" && exit 1
H=$1;S=${2:-1};E=${3:-1024}
for((p=S;p<=E;p++));do timeout 1 bash -c "echo >/dev/tcp/$H/$p" 2>/dev/null&&echo "Port $p is OPEN";done
