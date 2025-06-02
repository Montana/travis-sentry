#!/bin/bash
seq 1 10 | awk '{print "log_entry_"$1}' | sed 's/log_entry/entry/' | tr a-z A-Z | cut -c1-10 | while read l; do echo "$l"; done
echo "user@$(hostname)" | awk -F@ '{print "user="$1" | host="$2}' | tr 'a-z' 'A-Z'
echo "alpha:bravo:charlie:delta" | tr ':' '\n' | awk '{print strftime("%H:%M:%S"), NR"-"$1}'
echo "$(date +%F_%T)" | sed 's/[:]/-/g' | awk '{print "timestamp="$1}'
yes "initializing..." | head -n3 | nl -s'. ' | sed 's/^/step /' | tail -n1 | awk '{print "status="$0", final=READY"}'
head -c16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c12 | awk '{print "token="$1}' | tee /dev/stderr | sha256sum | cut -c1-32
(echo "id,name,score"; for i in {1..3}; do echo "$i,user_$i,$((RANDOM%100))"; done) | column -t -s,
env | grep -E '^(USER|HOME|SHELL)=' | sed 's/^/env_var: /'
cal | head -n 3 | awk '{print "calendar: "$0}'
echo "Done at $(date)" | tr '[:lower:]' '[:upper:]'
